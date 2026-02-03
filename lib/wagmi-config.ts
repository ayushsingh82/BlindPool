import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { sepolia } from "wagmi/chains"

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "YOUR_PROJECT_ID"

export const wagmiConfig = getDefaultConfig({
  appName: "BlindPool",
  projectId,
  chains: [sepolia],
  ssr: true,
})
