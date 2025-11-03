# CAMBIO: Se actualiza la versión base a Node 22-alpine.
# Esta imagen es ligera y contiene la versión de Node que solicitaste.
FROM node:22-alpine AS base

# 1. Etapa 'deps': Instalar dependencias
# Esta etapa se enfoca únicamente en instalar las dependencias para aprovechar el cacheo de Docker.
FROM base AS deps
# Alpine Linux puede necesitar esto para paquetes con dependencias nativas.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copia los archivos de manifiesto y lock.
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Instala dependencias según el gestor de paquetes detectado.
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# 2. Etapa 'builder': Construir la aplicación
# Esta etapa toma las dependencias y el código fuente para generar la build de producción.
FROM base AS builder
WORKDIR /app
# Copia las dependencias de la etapa anterior.
COPY --from=deps /app/node_modules ./node_modules
# Copia el resto del código fuente.
COPY . .

# Descomenta si quieres deshabilitar la telemetría durante la build.
# ENV NEXT_TELEMETRY_DISABLED 1

# Ejecuta el script de build (asegúrate de que coincida con tu package.json).
# Usaremos yarn como ejemplo.
RUN yarn build


# 3. Etapa 'runner': Imagen final de producción
# Esta es la imagen final, optimizada para ser pequeña y segura.
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Descomenta si quieres deshabilitar la telemetría en ejecución.
# ENV NEXT_TELEMETRY_DISABLED 1

# Crea un grupo y usuario no-root para ejecutar la aplicación.
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copia los archivos públicos.
COPY --from=builder /app/public ./public

# CAMBIO: Se elimina la creación manual de .next y el chown.
# La copia de la salida 'standalone' ya maneja esto.

# Copia la salida 'standalone' optimizada, que incluye todo lo necesario para correr el servidor.
# La bandera --chown asigna los permisos correctos directamente.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Cambia al usuario no-root.
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# El comando para iniciar el servidor de Next.js en modo standalone.
CMD ["node", "server.js"]