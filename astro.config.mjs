import { defineConfig } from "astro/config";
import decapCmsOauth from "astro-decap-cms-oauth";
import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwind from "@astrojs/tailwind";
import swup from "@swup/astro";
import expressiveCode from "astro-expressive-code";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
import icon from "astro-icon";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeComponents from "rehype-components";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive";
import remarkGithubAdmonitionsToDirectives from "remark-github-admonitions-to-directives";
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";
import { siteConfig } from "./src/config.ts";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.js";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { rehypeMermaid } from "./src/plugins/rehype-mermaid.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkExcerpt } from "./src/plugins/remark-excerpt.js";
import { remarkMermaid } from "./src/plugins/remark-mermaid.js";
import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs";

// ⭐ 关键：使用 Node SSR 适配器
import node from "@astrojs/node";

export default defineConfig({
  site: siteConfig.siteURL,

  // ⭐ 强制启用 SSR
  output: "server",

  // ⭐ 只保留这个 adapter
  adapter: node({
    mode: "standalone",
  }),

  base: "/",
  trailingSlash: "always",

  integrations: [
    decapCmsOauth({
      decapCMSVersion: "3.3.3",
      oauthDisabled: false,
    }),
    tailwind({ nesting: true }),
    swup({
      theme: false,
      animationClass: "transition-swup-",
      containers: ["main"],
      cache: true,
      preload: false,
      accessibility: true,
      updateHead: true,
    }),
    icon({
      include: {
        "fa6-brands": ["*"],
        "fa6-regular": ["*"],
        "fa6-solid": ["*"],
        mdi: ["*"],
      },
    }),
    expressiveCode({
      themes: ["github-light", "github-dark"],
      plugins: [
        pluginCollapsibleSections(),
        pluginLineNumbers(),
        pluginLanguageBadge(),
        pluginCustomCopyButton(),
      ],
    }),
    svelte(),
    sitemap(),
  ],

  markdown: {
    remarkPlugins: [
      remarkMath,
      remarkReadingTime,
      remarkExcerpt,
      remarkGithubAdmonitionsToDirectives,
      remarkDirective,
      remarkSectionize,
      parseDirectiveNode,
      remarkMermaid,
    ],
    rehypePlugins: [
      rehypeKatex,
      rehypeSlug,
      rehypeMermaid,
      [
        rehypeComponents,
        {
          components: {
            github: GithubCardComponent,
            note: (x, y) => AdmonitionComponent(x, y, "note"),
            tip: (x, y) => AdmonitionComponent(x, y, "tip"),
            important: (x, y) => AdmonitionComponent(x, y, "important"),
            caution: (x, y) => AdmonitionComponent(x, y, "caution"),
            warning: (x, y) => AdmonitionComponent(x, y, "warning"),
          },
        },
      ],
      [rehypeAutolinkHeadings, { behavior: "append" }],
    ],
  },
});
