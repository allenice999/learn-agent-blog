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
      { text: "Agent", link: "/notes/agent/LLM消息" },
      { text: "React", link: "/notes/react" },
      { text: "Python", link: "/notes/python/Pydantic转JSON" },
      { text: "决策", link: "/decisions/sse协议设计" },
    ],
    sidebar: {
      "/decisions/": {
        base: "decisions",
        items: [{ text: "1. SSE协议设计", link: "/sse协议设计" }],
      },
      "/notes/react/": {
        items: [
          {
            text: "react",
            link: "/notes/react",
            items: [
              { text: "1. JSX与组件", link: "/notes/react/jsx与组件" },
              { text: "2. Hooks核心", link: "/notes/react/hooks核心" },
              { text: "3. 表单与数据流", link: "/notes/react/表单与数据流" },
              { text: "4. Context用法", link: "/notes/react/context用法" },
              {
                text: "5. useReducer与Zustand",
                link: "/notes/react/useReducer与zustand",
              },
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
      "/notes/agent/": {
        items: [
          {
            text: "Agent",
            link: "/notes/agent/LLM消息",
            items: [
              { text: "1. LLM消息", link: "/notes/agent/LLM消息" },
              { text: "2. mcp概念", link: "/notes/agent/mcp概念" },
              {
                text: "3. codex连接不上fastmcp的stdio",
                link: "/notes/agent/codex连接不上fastmcp的stdio",
              },
            ],
          },
        ],
      },
      "/notes/python/": {
        items: [
          {
            text: "Python",
            link: "/notes/python/Pydantic转JSON",
            items: [
              { text: "1. Pydantic转JSON", link: "/notes/python/Pydantic转JSON" },
              { text: "2. OpenAI SDK调用问题", link: "/notes/python/OpenAI_SDK调用问题" },
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
    "decisions/0010-sse协议设计.md": "decisions/sse协议设计.md",

    "notes/react/0010-jsx与组件.md": "notes/react/jsx与组件.md",
    "notes/react/0020-hooks核心.md": "notes/react/hooks核心.md",
    "notes/react/0030-表单与数据流.md": "notes/react/表单与数据流.md",
    "notes/react/0040-context用法.md": "notes/react/context用法.md",
    "notes/react/0045-useReducer与zustand.md":
      "notes/react/useReducer与zustand.md",
    "notes/react/0050-nextjs的app_router.md":
      "notes/react/nextjs的app_router.md",
    "notes/react/0060-api与环境变量.md": "notes/react/api与环境变量.md",
    "notes/react/0070-fetch流式响应.md": "notes/react/fetch流式响应.md",



    "notes/agent/0010-LLM消息.md": "notes/agent/LLM消息.md",
    "notes/agent/0015-mcp概念.md": "notes/agent/mcp概念.md",
    "notes/agent/0020-codex连接不上fastmcp的stdio.md":
      "notes/agent/codex连接不上fastmcp的stdio.md",

    "notes/python/0010-Pydantic转JSON.md": "notes/python/Pydantic转JSON.md",
    "notes/python/0020-OpenAI_SDK调用问题.md": "notes/python/OpenAI_SDK调用问题.md",

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
