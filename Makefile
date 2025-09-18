start:
	bun run compile && bun run test

deploy-testnet:
	bun run compile && npx hardhat task:deploy-bridge --network berachain-testnet
	

deploy-mainnet:
	bun run compile && npx hardhat task:deploy-bridge --network berachain-mainnet
	