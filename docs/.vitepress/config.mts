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
      { text: "笔记", link: "/notes" },
      { text: "决策", link: "/decisions" },
    ],
    sidebar: [
      {
        // text: "Examples",
        // items: [
        //   { text: "Markdown Examples", link: "/markdown-examples" },
        //   { text: "Runtime API Examples", link: "/api-examples" },
        // ],
      },
    ],
    // socialLinks: [
    //   { icon: "github", link: "https://github.com/vuejs/vitepress" },
    // ],
  },
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/learn-agent-blog/logo.svg" }]],
});
