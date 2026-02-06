import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { sepolia } from "wagmi/chains"
import { http } from "wagmi"

const projectId = process.env.PROJECT_ID || "a73ceeb8d8079b8c1dc4d9d5ebbc0433"

export const wagmiConfig = getDefaultConfig({
  appName: "BlindPool",
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: true,
})
