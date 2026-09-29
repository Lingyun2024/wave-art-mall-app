# LoopX — 跨会话 Agent 上下文留存工具

> 来源：抖音「金哲AI」视频（`G:\Cherry studio\video_work\7674529168910077199\summary.md`、`subtitle.clean.txt`）+ GitHub https://github.com/huangruiteng/loopx

## 定位
开放、供应商中立、有状态的长周期 agent 控制平面（control plane），运行在 Codex / Claude Code / Cursor 等之上，跨回合保留：目标 / 待办 / 门槛(gate) / 证据 / 配额 / 交接(handoff)。

## 解决的痛点
Coding Agent「跨会话重讲进度」——把之前的会话留在「任务卡」，新任务打开先读它，目标与进度被留住，不用翻旧聊天记录。

## 技术
- Python 3.11+
- 安装：`pip install loopx`
- 无第三方运行时依赖（仅标准库）
- 许可：Apache-2.0（v0.4.8 起；v0.4.7 及之前为 MIT）

## 适用判断
- **仅长期任务跨多个会话才值得加这层**；
- 当天结束的短任务 / 单轮写码不必。

## 关联
- 已同步入 WorkBuddy 长期记忆（`~/.workbuddy/MEMORY.md`「关注的工具 / 参考资料」一节）。
