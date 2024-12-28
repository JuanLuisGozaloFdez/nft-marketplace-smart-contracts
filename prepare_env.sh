#!/bin/bash

echo "Preparando el entorno para Hardhat..."

# Inicializar el proyecto npm si no existe package.json
if [ ! -f package.json ]; then
    echo "Inicializando proyecto npm..."
    npm init -y
fi

# Instalar Hardhat y sus dependencias
echo "Instalando Hardhat y dependencias principales..."
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Instalar plugins adicionales
echo "Instalando plugins adicionales..."
npm install --save-dev @nomiclabs/hardhat-etherscan dotenv

# Instalar OpenZeppelin Contracts
echo "Instalando OpenZeppelin Contracts..."
npm install @openzeppelin/contracts

# Fixing dependencies
npm audit fix
echo "Instalación completada. Asegúrate de configurar tu archivo .env con las variables necesarias."
