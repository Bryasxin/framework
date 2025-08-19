import type { Constructor } from "type-fest";

export interface ComponentOptions {
	/**
	 * 组件作用域
	 * @default "singleton"
	 */
	scope?: ComponentScope;
	/**
	 * 组件名称
	 * @default 类名
	 */
	name?: string;
}

export type InjectOptions<T> = { name?: string } | { component?: Constructor<T> };

export type ContainerExtensionOptions = {
	/**
	 * 容器扩展名称
	 * @default 类名
	 */
	name?: string;
};

export interface ContainerExtensionInterface {
	/**
	 * 钩子: 当组件创建前
	 */
	preCreate?(): Promise<void>;
	/**
	 * 钩子: 当组件创建后
	 */
	postCreate?(component: unknown): Promise<unknown>;
	/**
	 * 钩子: 当组件销毁前
	 */
	preDestroy?(component: unknown): Promise<unknown>;
	/**
	 * 钩子: 当组件销毁后
	 */
	postDestroy?(): Promise<void>;
}

export type ComponentScope = "singleton" | "prototype";
