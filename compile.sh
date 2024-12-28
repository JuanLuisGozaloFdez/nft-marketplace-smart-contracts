#!/bin/bash

echo "Compilando contratos..."
npx hardhat compile
if [ $? -eq 0 ]; then
    echo "Compilación exitosa"
else
    echo "Error en la compilación"
    exit 1
fi
