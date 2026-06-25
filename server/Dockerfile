FROM golang:1.25-alpine AS build

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o cartografo-api ./cmd/api

FROM alpine:3.21

RUN apk add --no-cache tzdata

WORKDIR /app

COPY --from=build /app/cartografo-api .

EXPOSE 8080

CMD ["./cartografo-api"]
