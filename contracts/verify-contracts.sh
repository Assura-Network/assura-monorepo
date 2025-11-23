#!/bin/bash
echo "=== Verifying Contract Changes ==="
echo ""

echo "1. Checking AssuraVerifier constructor (should have 2 parameters):"
cat artifacts/contracts/assura/AssuraVerifier.sol/AssuraVerifier.json | jq '.abi[] | select(.type == "constructor") | .inputs | length'

echo ""
echo "2. Checking for getNexusAccountDeployer function:"
cat artifacts/contracts/assura/AssuraVerifier.sol/AssuraVerifier.json | jq '.abi[] | select(.name == "getNexusAccountDeployer") | .name'

echo ""
echo "3. Checking for nexusAccountDeployer state variable:"
cat artifacts/contracts/assura/AssuraVerifier.sol/AssuraVerifier.json | jq '.abi[] | select(.name == "nexusAccountDeployer") | .name'

echo ""
echo "4. Verifying Solidity files compile:"
forge build --force 2>&1 | grep -E "(Compiler run|Error)" | head -5

echo ""
echo "=== All Checks Complete ==="
