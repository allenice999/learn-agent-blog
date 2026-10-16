import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "AI Agent 实践",
  description: "记录和分享在学习AI Agent开发过程中的一些心得",
  base: "/learn-agent-blog/",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "首页", link: "/" },
      { text: "笔记", link: "/notes/react" },
      { text: "决策", link: "/decisions" },
    ],
    sidebar: {
      "/notes/": {
        base: "notes",
        items: [
          {
            text: "react",
            link: "/react",
            items: [
              { text: "1. jsx与组件", link: "/react/jsx与组件" },
              { text: "2. hooks核心", link: "/react/hooks核心" },
            ],
          },
        ],
      },
    },
    // socialLinks: [
    //   { icon: "github", link: "https://github.com/vuejs/vitepress" },
    // ],
  },
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/learn-agent-blog/logo.svg",
      },
    ],
  ],
  cleanUrls: true,
  rewrites: {
    "notes/react/0010-jsx与组件.md": "notes/react/jsx与组件.md",
    "notes/react/0020-hooks核心.md": "notes/react/hooks核心.md",
  },
  markdown: {
    config: (md) => {
      const render = md.render;
      md.render = function (src, env) {
        return `<div v-pre>${render.call(this, src, env)}</div>`;
      };
    },
    html: false,
    attrs: false,
  },
});
