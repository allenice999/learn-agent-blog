---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "AI Agent 实践"
  text: "从 Vue 前端到 AI Agent 工程师"
  tagline: 记录 DevPilot 研发 Agent 工作台的完整构建过程 —— RAG、自研 MCP Server、LangGraph 多 Agent、可视化与评测
  actions:
    - theme: brand
      text: 笔记
      link: /notes/react/jsx与组件
    # - theme: alt
    #   text: 项目架构
    #   link: /architecture
    - theme: alt
      text: 决策
      link: /decisions

features:
  - title: React 速转 + 全栈骨架
    details: 从 Vue 迁移到 React/Next.js App Router，搭起 Docker Compose 三服务骨架（Next.js + FastAPI + 自研 MCP Server），跑通前后端与 MCP ping 链路。
  - title: 流式 AI 聊天应用
    details: 手写 SSE 解析、LLM 流式渲染、多轮上下文与结构化输出，理解 token 推送、重试降级与前端逐字追加的完整原理。
  - title: RAG 数据源与入库
    details: 文档 + 代码库切分（tree-sitter）、BGE-M3 Embedding、pgvector 建表与相似度检索，打通"切分 → 向量化 → 召回"链路。
  - title: RAG 检索优化 + 引用
    details: Hybrid Search 融合向量与关键词、bge-reranker-v2-m3 重排、查询改写与来源引用，用评测集量化命中率提升。
  - title: LangGraph 多 Agent + 可视化
    details: Tool Calling 完整链路、StateGraph 状态机、human-in-the-loop 断点，用 React Flow 实时映射 Agent 执行流程与工具卡片。
  - title: 自研 MCP Server + 高危审批
    details: 独立 MCP 进程、Tools/Resources/Prompts 协议、风险分级与路径沙箱，高危操作弹窗审批 + 审计落库，MCP Inspector 可发现调用。
  - title: 多 Agent 协作 + 评测看板
    details: Supervisor 编排、PostgresSaver 持久记忆、黄金任务集评测（成功率 / 工具正确率 / 越权违反率 / 成本 / 耗时）与安全收尾。
  - title: 整合包装 + 求职冲刺
    details: README 架构图、演示视频、线上部署、量化数据与技术博客，按目标 JD 重写简历并准备 Codex 对比题。
---