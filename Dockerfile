# Dockerfile

# --- Estágio 1: Builder ---
# Usamos uma imagem Node.js leve (Alpine) para instalar as dependências
FROM node:20-alpine AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de gerenciamento de pacotes
COPY package.json package-lock.json ./

# Instala apenas as dependências de produção
RUN npm install --only=production

# --- Estágio 2: Production ---
# Usa a mesma imagem base leve para a versão final
FROM node:20-alpine

WORKDIR /app

# Copia as dependências já instaladas do estágio 'builder'
COPY --from=builder /app/node_modules ./node_modules

# Copia o resto do código da aplicação
COPY . .

# Expõe a porta que a nossa aplicação usa
EXPOSE 3000

# O comando para iniciar a aplicação quando o container rodar
CMD [ "node", "server.js" ]