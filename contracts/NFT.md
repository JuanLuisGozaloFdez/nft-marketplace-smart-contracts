# NFT.sol - Contrato Seguro para NFTs

## Medidas de Seguridad Implementadas

Este contrato implementa las siguientes medidas de seguridad:

1. Utiliza `ERC721URIStorage` de OpenZeppelin para una implementación segura del estándar ERC721.
2. Emplea `Ownable` para control de acceso a funciones administrativas.
3. Implementa `ReentrancyGuard` para prevenir ataques de reentrada.
4. Usa `Counters` para generar IDs únicos para cada NFT de manera segura.
5. Implementa un mapeo `_tokenExists` para evitar la duplicación de tokens.
6. Utiliza `require` para validaciones y manejo de errores.
7. Emplea `_safeMint` para una acuñación segura de tokens.
8. Implementa una función `burn` segura que solo puede ser llamada por el propietario o una dirección aprobada.
9. Sobrescribe `_beforeTokenTransfer` para prevenir transferencias a la dirección cero.
10. Emite eventos para registrar acciones importantes como la acuñación de NFTs.

## Funcionalidades

Este contrato proporciona funcionalidades básicas y seguras para la creación y gestión de NFTs, minimizando los riesgos de vulnerabilidades comunes en contratos inteligentes de tokens no fungibles.
