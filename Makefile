start:
	bun run compile && bun run test

deploy-testnet:
	bun run compile && npx hardhat task:deploy --network berachain-testnet
