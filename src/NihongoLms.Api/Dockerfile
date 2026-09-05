FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /app

# Copy csproj files and restore dependencies
COPY src/NihongoLms.Domain/NihongoLms.Domain.csproj src/NihongoLms.Domain/
COPY src/NihongoLms.Application/NihongoLms.Application.csproj src/NihongoLms.Application/
COPY src/NihongoLms.Infrastructure/NihongoLms.Infrastructure.csproj src/NihongoLms.Infrastructure/
COPY src/NihongoLms.Api/NihongoLms.Api.csproj src/NihongoLms.Api/
RUN dotnet restore src/NihongoLms.Api/NihongoLms.Api.csproj

# Copy all sources and build
COPY src/ src/
RUN dotnet publish src/NihongoLms.Api/NihongoLms.Api.csproj -c Release -o /out

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS runtime
WORKDIR /app
COPY --from=build /out .
EXPOSE 5222
ENV ASPNETCORE_URLS=http://+:5222
ENTRYPOINT ["dotnet", "NihongoLms.Api.dll"]
