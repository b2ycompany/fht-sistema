// next.config.mjs
var userConfig = void 0;
try {
  userConfig = await import("./v0-user-next.config");
} catch (e) {
}
var nextConfig = {
  // ADICIONADO: Desativa o Strict Mode para resolver o problema com a biblioteca de vídeo.
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true
  },
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    unoptimized: true
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true
  }
};
mergeConfig(nextConfig, userConfig);
function mergeConfig(nextConfig2, userConfig2) {
  if (!userConfig2) {
    return;
  }
  for (const key in userConfig2) {
    if (typeof nextConfig2[key] === "object" && !Array.isArray(nextConfig2[key])) {
      nextConfig2[key] = {
        ...nextConfig2[key],
        ...userConfig2[key]
      };
    } else {
      nextConfig2[key] = userConfig2[key];
    }
  }
}
var next_config_default = nextConfig;
export {
  next_config_default as default
};
