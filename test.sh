#!/bin/bash

echo "Ejecutando pruebas..."
npx hardhat test | tee test_output.log
if grep -q "failing" test_output.log; then
    echo "Se encontraron errores en las pruebas:"
    grep -A 3 "failing" test_output.log
    exit 1
else
    echo "Todas las pruebas pasaron exitosamente"
fi
