// Uniswap ASCII Art

const UNISWAP_ASCII = `
██╗   ██╗███╗   ██╗██╗███████╗██╗    ██╗ █████╗ ██████╗ 
██║   ██║████╗  ██║██║██╔════╝██║    ██║██╔══██╗██╔══██╗
██║   ██║██╔██╗ ██║██║███████╗██║ █╗ ██║███████║██████╔╝
██║   ██║██║╚██╗██║██║╚════██║██║███╗██║██╔══██║██╔═══╝ 
╚██████╔╝██║ ╚████║██║███████║╚███╔███╔╝██║  ██║██║     
 ╚═════╝ ╚═╝  ╚═══╝╚═╝╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝     
`;

const UNISWAP_LOGO_COMPACT = `
╔═══════════════════════════════════════════╗
║  UNISWAP - Cross-Chain Analytics Suite   ║
╚═══════════════════════════════════════════╝
`;

function getUniswapLogo(style = "full") {
  switch (style) {
    case "full":
      return UNISWAP_ASCII;
    case "compact":
      return UNISWAP_LOGO_COMPACT;
    default:
      return UNISWAP_ASCII;
  }
}

function printUniswapLogo(style = "full") {
  console.log(getUniswapLogo(style));
}

module.exports = {
  UNISWAP_ASCII,
  UNISWAP_LOGO_COMPACT,
  getUniswapLogo,
  printUniswapLogo,
};

