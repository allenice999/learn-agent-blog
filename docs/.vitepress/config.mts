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
        items: [
          {
            text: "react",
            link: "/notes/react",
            items: [
              { text: "1. JSX与组件", link: "/notes/react/jsx与组件" },
              { text: "2. Hooks核心", link: "/notes/react/hooks核心" },
              { text: "3. 表单与数据流", link: "/notes/react/表单与数据流" },
              { text: "4. Context用法", link: "/notes/react/context用法" },
              { text: "5. useReducer与Zustand", link: "/notes/react/useReducer与zustand" },
              {
                text: "6. Nextjs App Router",
                link: "/notes/react/nextjs的app_router",
              },
              { text: "7. API与环境变量", link: "/notes/react/api与环境变量" },
              {
                text: "8. 流式响应（概念）",
                link: "/notes/react/fetch流式响应",
              },
            ],
          },
        ],
      },
    },
    docFooter: {
      prev: "上一篇文章",
      next: "下一篇文章",
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
    "notes/react/0030-表单与数据流.md": "notes/react/表单与数据流.md",
    "notes/react/0040-context用法.md": "notes/react/context用法.md",
    "notes/react/0045-useReducer与zustand.md": "notes/react/useReducer与zustand.md",
    "notes/react/0050-nextjs的app_router.md":
      "notes/react/nextjs的app_router.md",
    "notes/react/0060-api与环境变量.md": "notes/react/api与环境变量.md",
    "notes/react/0070-fetch流式响应.md": "notes/react/fetch流式响应.md",
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
