# Async CMS API（课程大作业版）

这是按你摘要实现的一版可运行 MVP：
- FastAPI + SQLAlchemy Async
- MySQL + Redis
- JWT 鉴权 + Admin/User 角色控制
- 文章/分类/评论 REST 接口
- Redis 分布式 Session（登录会话）
- 基于 IP + 路径 的限流（每分钟）
- Docker 一键启动

## 1. 启动方式（推荐 Docker）

```bash
docker compose up --build
```

### 1.1 Docker Desktop（Windows）网络配置

如果构建报错：`failed to fetch anonymous token`，通常是访问 Docker Hub 网络不通。

1) 打开 Docker Desktop → `Settings` → `Docker Engine`

2) 在 JSON 里加入镜像加速（示例，可替换为你自己的可用地址）：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com"
  ]
}
```

3) 点击 `Apply & Restart`

4) 终端验证：

```bash
docker login
docker pull python:3.12-slim
```

5) 回到项目目录重新构建：

```bash
docker compose build --no-cache
docker compose up
```

### 1.2 可选：为构建阶段配置 pip 镜像

在项目根目录新建 `.env`（可从 `.env.example` 复制），设置：

```env
PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn
```

然后重试：

```bash
docker compose build --no-cache
```

### 1.3 可选：切换基础镜像

如果官方 `python:3.12-slim` 拉取仍不稳定，可在 `.env` 中覆盖：

```env
BASE_IMAGE=python:3.12
```

项目已支持通过 `BASE_IMAGE` 动态切换基础镜像，无需修改 Dockerfile。

启动后访问：
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health
- MySQL（主机直连）: localhost:3307（容器内部仍为 3306）

系统会在首次启动自动建表，并创建默认管理员：
- 用户名: `admin`
- 密码: `admin123`

## 2. 关键接口流程

1) 登录：`POST /api/v1/auth/login`

```json
{
  "username": "admin",
  "password": "admin123"
}
```

2) 拿到 `access_token` 后，在 Swagger 右上角 Authorize 输入：

```
Bearer <token>
```

3) 管理员创建分类：`POST /api/v1/categories`

4) 普通用户/管理员发文章：`POST /api/v1/posts`

5) 评论文章：`POST /api/v1/posts/{post_id}/comments`

## 3. 本地运行（不走 Docker）

- 复制 `.env.example` 为 `.env`
- 把 `DATABASE_URL`、`REDIS_URL` 改成你本机服务地址
- 安装依赖并启动

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 4. 说明

- 当前是“可演示 + 可扩展”的课程版基础架构。
- 密码哈希已使用 `pbkdf2_sha256`，避免了容器中 `passlib/bcrypt` 兼容性问题。
- 若你要冲高分，下一步建议加：
  - Alembic 迁移脚本
  - 单元测试与集成测试
  - 更细粒度权限（文章编辑者权限）
  - 评论分页与搜索
