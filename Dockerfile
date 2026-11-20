FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY NexComerce.slnx ./
COPY src/NexComerce.Api/NexComerce.Api.csproj src/NexComerce.Api/
COPY src/NexComerce.Domain/NexComerce.Domain.csproj src/NexComerce.Domain/
COPY src/NexComerce.Infrastructure/NexComerce.Infrastructure.csproj src/NexComerce.Infrastructure/
RUN dotnet restore src/NexComerce.Api/NexComerce.Api.csproj

COPY . .
RUN dotnet publish src/NexComerce.Api/NexComerce.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# Render inyecta PORT; fuera de Render usa 8080.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} exec dotnet NexComerceApp.dll"]
