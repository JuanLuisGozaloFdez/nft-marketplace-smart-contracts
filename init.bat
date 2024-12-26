@echo off

:: Crear directorios principales
mkdir contracts
mkdir scripts
mkdir test

:: Crear archivos de contratos
echo. > contracts\NFT.sol
echo. > contracts\Marketplace.sol
echo. > contracts\ERC721.sol

:: Crear archivos de scripts
echo. > scripts\deploy.js
echo. > scripts\mint.js

:: Crear archivos de test
echo. > test\NFT.test.js
echo. > test\Marketplace.test.js

:: Crear archivos de configuración
echo. > hardhat.config.js
echo. > .env

:: Crear archivo README
echo # NFT Marketplace Smart Contracts > README.md

echo Estructura del proyecto creada con éxito.
