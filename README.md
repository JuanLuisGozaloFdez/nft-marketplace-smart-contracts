# NFT Marketplace Smart Contracts

## Introducción

Este repositorio contiene los contratos inteligentes necesarios para implementar un marketplace de NFTs (tokens no fungibles) en la blockchain. Los contratos están diseñados para gestionar la creación, compra y venta de activos digitales únicos.

## Tabla de Contenidos

- [Propósito del Proyecto](#propósito-del-proyecto) Explica qué se busca lograr con el proyecto.
- [Tecnologías Utilizadas](#tecnologías-utilizadas) Enumera las herramientas y lenguajes utilizados en el desarrollo.
- [Estructura del Proyecto](#estructura-del-proyecto) Muestra cómo está organizado el código en carpetas y archivos.
- [Instalación](#instalación) Pasos necesarios para clonar el repositorio e instalar dependencias.
- [Uso](#uso) Instrucciones sobre cómo compilar, desplegar y acuñar NFTs.
- [Pruebas](#pruebas) Cómo ejecutar pruebas unitarias para verificar el funcionamiento del código.
- [Contribuciones](#contribuciones) Invita a otros a contribuir al proyecto.
- [Licencia](#licencia) Información sobre la licencia bajo la cual se distribuye el proyecto.

## Propósito del Proyecto

El objetivo de este proyecto es proporcionar una solución completa para la gestión de NFTs en un marketplace, permitiendo a los usuarios crear, comprar y vender activos digitales de manera segura y eficiente.
Este proyecto establece el desarrollo de los contratos inteligentes del marketplace NFT. El contrato NFT.sol se basará en el estándar ERC721, que es ampliamente utilizado para tokens no fungibles. El contrato Marketplace.sol gestionará la lógica de compra y venta de NFTs, incluyendo la implementación de contratos inteligentes para especificar los términos de venta entre compradores y vendedores.

## Tecnologías Utilizadas

- **Solidity**: Lenguaje de programación para contratos inteligentes.
- **Hardhat**: Entorno de desarrollo para compilar, probar y desplegar contratos inteligentes.
- **Ethers.js**: Biblioteca para interactuar con la blockchain Ethereum.
- **Node.js**: Entorno de ejecución para ejecutar scripts JavaScript.

## Estructura del Proyecto

- **/contracts**: Contiene los contratos inteligentes principales.
  - NFT.sol: Contrato para la creación y gestión de NFTs.
  - Marketplace.sol: Contrato para la funcionalidad del marketplace.
  - ERC721.sol: Implementación del estándar ERC721 para NFTs[2].

- **/scripts**: Scripts para despliegue y interacción con los contratos.
  - deploy.js: Script para desplegar los contratos.
  - mint.js: Script para acuñar NFTs.

- **/test**: Archivos de prueba para los contratos.
  - NFT.test.js: Pruebas para el contrato NFT.
  - Marketplace.test.js: Pruebas para el contrato Marketplace.

- **hardhat.config.js**: Archivo de configuración para Hardhat.
- **.env**: Archivo para variables de entorno (claves privadas, URLs de RPC, etc.).
- **README.md**: Documentación básica del proyecto.

## Instalación

1. Clona el repositorio:

   ```bash
   git clone https://github.com/tu_usuario/nft-marketplace-smart-contracts.git
   cd nft-marketplace-smart-contracts
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Configura las variables de entorno en el archivo `.env`.

## Uso

Para compilar los contratos:

```bash
npx hardhat compile
```

Para desplegar los contratos en una red de prueba:

```bash
npx hardhat run scripts/deploy.js --network <nombre_red>
```

Para acuñar un nuevo NFT:

```bash
npx hardhat run scripts/mint.js --network <nombre_red>
```

## Pruebas

Para ejecutar las pruebas unitarias:

```bash
npx hardhat test
```

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o envía un pull request para discutir cualquier cambio que desees hacer.

## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo LICENSE para más detalles.## Estructura del Proyecto
