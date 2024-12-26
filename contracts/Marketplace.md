# Marketplace.sol - Contrato Seguro para NFT Marketplace

## Medidas de Seguridad Implementadas

Este contrato implementa las siguientes medidas de seguridad:

1. Utiliza `ReentrancyGuard` para prevenir ataques de reentrada.
2. Implementa el patrón "checks-effects-interactions" en funciones críticas.
3. Usa `nonReentrant` en funciones que manejan transferencias de ETH.
4. Emplea `Ownable` para control de acceso a funciones administrativas.
5. Utiliza `require` para validaciones y manejo de errores.
6. Evita el uso de `transfer` o `send`, optando por `call` para transferencias de ETH.
7. Implementa un sistema de listado y compra seguro.
8. Permite la cancelación de listados solo por el vendedor.
9. Maneja correctamente los reembolsos de exceso de pago.
10. Utiliza eventos para registrar acciones importantes.

## Funcionalidades

Este contrato proporciona funcionalidades básicas de un marketplace de NFTs de manera segura, minimizando los riesgos de vulnerabilidades comunes en contratos inteligentes.
