# Release Checklist

> 公开发布（开源/版本发布）前必须通过的检查。

---

## 1. 全量回归

```
□ Gate 0 全部通过
□ 无已知 blocker bug
□ 无 security 漏洞
```

## 2. 安装测试

### Windows（新电脑）
```
□ git clone 成功
□ pip install -r requirements.txt 成功
□ npm install 成功
□ python -m uvicorn app.main:app 可启动
□ npm run dev 可启动
□ 浏览器可访问
□ 无报错
```

## 3. 数据迁移测试

```
□ 旧版本 DB 可被新版本 migration 升级
□ 升级后数据不丢失
□ 版本号正确
```

## 4. 导出测试

```
□ vault/ 可独立使用（Obsidian 可打开）
□ metadata/ 可备份
□ 无私有格式数据
□ 无云端绑定
```

## 5. 文档检查

```
□ README.md 可读
□ CONTRIBUTING.md 可读
□ CHANGELOG.md 完整
□ 无内部敏感信息
□ 无 API key / 密码
```

## 6. 版本标记

```
□ Git tag v0.x.x
□ CHANGELOG 更新
□ package.json 版本号
```

---

**全部通过 = 可发布。**
