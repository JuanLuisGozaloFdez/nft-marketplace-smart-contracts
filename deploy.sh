#!/bin/bash

echo "Desplegando contratos..."
npx hardhat run scripts/deploy.js --network sepolia
if [ $? -eq 0 ]; then
    echo "Despliegue exitoso"
else
    echo "Error en el despliegue"
    exit 1
fi
