# Framework

[![Checked with Biome](https://img.shields.io/badge/Checked_with-Biome-60a5fa?style=flat&logo=biome)](https://biomejs.dev)

## 简介

Framework 是一个基于 TypeScript
的轻量级依赖注入框架，提供了基于装饰器的组件管理功能。
它支持自动依赖注入、单例/原型作用域、组件工厂模式以及扩展机制。

> [!WARNING]
> 尚未解决组件循环依赖的问题

## 功能特性

- `@Component` 装饰器自动注册组件和依赖注入
- `@ComponentFactory` 和 `@ReturnComponent` 装饰器支持工厂模式
- 构造函数参数自动注入依赖
- 单例 (Singleton) 和原型 (Prototype) 作用域支持
- 容器和组件扩展机制
- 组件生命周期管理
