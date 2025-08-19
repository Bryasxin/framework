import "reflect-metadata";
import type { Constructor } from "type-fest";
import { DependencyNotFoundException } from "./exception/dependency-not-found.exception";
import { NotAComponentException } from "./exception/not-a-component.exception";
import type { ContainerExtensionInterface, InjectOptions } from "./interface";
import * as metadata from "./metadata";
import { throwIfIsNotComponent } from "./utilities";

// 核心容器实现
// biome-ignore lint/complexity/noStaticOnlyClass: 核心组件 - IoC 容器
export class Container {
	/** 容器扩展列表 */
	private static extensions: ContainerExtensionInterface[] = [];
	/** 组件注册映射 */
	private static registry: Map<string, Constructor<unknown>> = new Map();
	/** 组件实例映射 */
	private static instances: Map<string, unknown> = new Map();
	/** 工厂函数映射 */
	private static factoryComponents: Map<string, () => unknown> = new Map();

	/**
	 * 注册组件
	 * @param component 组件
	 */
	public static async register<T>(component: Constructor<T>): Promise<void> {
		throwIfIsNotComponent(component);

		// 注册组件
		const componentName = Reflect.getMetadata(metadata.COMPONENT_NAME, component);
		if (Container.registry.has(componentName)) return;
		Container.registry.set(componentName, component);

		// 如果是工厂类, 处理其中的工厂方法
		const isFactory = Reflect.getMetadata(metadata.IS_COMPONENT_FACTORY, component) ?? false;
		if (isFactory) await Container.processFactoryClass(component);
	}

	/**
	 * 处理工厂类, 注册其中的工厂方法
	 * @param component 工厂类组件
	 */
	private static async processFactoryClass<T>(component: Constructor<T>): Promise<void> {
		// 获取工厂类实例
		const factoryInstance = await Container.resolve(component);

		// 获取类原型上的所有方法
		const { prototype } = component;
		const methodNames = Object.getOwnPropertyNames(prototype).filter(
			(name) => name !== "constructor" && typeof prototype[name] === "function",
		);

		// 处理每个工厂方法
		for (const methodName of methodNames) {
			// 获取工厂方法返回的组件
			const { component: componentConstructor } = Reflect.getMetadata(
				metadata.FACTORY_RESULT,
				component.prototype,
				methodName,
			);
			if (!componentConstructor) continue;

			const componentName = Reflect.getMetadata(metadata.COMPONENT_NAME, componentConstructor);

			// 检查组件是否已经注册, 如果已注册则跳过
			if (Container.registry.has(componentName)) continue;

			// 注册工厂创建的组件
			Container.factoryComponents.set(componentName, () =>
				// biome-ignore lint/style/noNonNullAssertion: 类型没错
				(factoryInstance as Record<string, () => unknown>)[methodName]!(),
			);
			Container.registry.set(componentName, componentConstructor);
		}
	}

	/**
	 * 获取组件实例
	 * @param component 组件
	 */
	public static async resolve<T>(component: Constructor<T>): Promise<T> {
		const componentName = Reflect.getMetadata(metadata.COMPONENT_NAME, component);
		if (!componentName) throw new NotAComponentException(component.name);

		const componentScope = Reflect.getMetadata(metadata.COMPONENT_SCOPE, component) ?? "singleton";

		// 处理单例实例
		if (Container.factoryComponents.has(componentName) || Container.instances.has(componentName)) {
			return Container.getSingletonInstance(component, componentName, componentScope);
		}

		// 创建新实例
		return Container.createNewInstance(component, componentName, componentScope);
	}

	/**
	 * 获取单例实例
	 * @param component 组件
	 * @param componentName 组件名称
	 * @param componentScope 组件作用域
	 */
	private static async getSingletonInstance<T>(
		component: Constructor<T>,
		componentName: string,
		componentScope: string,
	): Promise<T> {
		let instance: T;

		if (Container.factoryComponents.has(componentName)) {
			const componentProvider = Container.factoryComponents.get(componentName);
			// biome-ignore lint/style/noNonNullAssertion: 一定存在
			instance = componentProvider!() as T;
		} else {
			instance = Container.instances.get(componentName) as T;
		}

		// 处理属性注入
		await Container.injectProperties(instance, component);

		// 执行扩展钩子
		await Container.executePostCreateHooks(instance, component);

		if (componentScope === "singleton") {
			Container.instances.set(componentName, instance);
		}

		return instance;
	}

	/**
	 * 创建新实例
	 * @param component 组件
	 * @param componentName 组件名称
	 * @param componentScope 组件作用域
	 */
	private static async createNewInstance<T>(
		component: Constructor<T>,
		componentName: string,
		componentScope: string,
	): Promise<T> {
		// 执行 preCreate 扩展钩子
		await Container.executePreCreateHooks(component);

		const instance = await Container.createInstance(component);

		// 执行 postCreate 扩展钩子
		await Container.executePostCreateHooks(instance, component);

		// 如果为单例则保存实例
		if (componentScope === "singleton") {
			Container.instances.set(componentName, instance);
		}

		return instance;
	}

	/**
	 * 执行 preCreate 扩展钩子
	 * @param component 组件
	 */
	private static async executePreCreateHooks<T>(component: Constructor<T>): Promise<void> {
		const componentExtensions = Reflect.getMetadata(metadata.COMPONENT_EXTENSIONS, component) ?? [];

		for (const extension of componentExtensions) {
			if (extension.preCreate) await extension.preCreate();
		}
		for (const extension of Container.extensions) {
			if (extension.preCreate) await extension.preCreate();
		}
	}

	/**
	 * 执行 postCreate 扩展钩子
	 * @param instance 组件实例
	 * @param component 组件
	 */
	private static async executePostCreateHooks<T>(instance: T, component: Constructor<T>): Promise<void> {
		const componentExtensions = Reflect.getMetadata(metadata.COMPONENT_EXTENSIONS, component) ?? [];

		for (const extension of componentExtensions) {
			if (extension.postCreate) await extension.postCreate(instance);
		}
		for (const extension of Container.extensions) {
			if (extension.postCreate) await extension.postCreate(instance);
		}
	}

	/**
	 * 销毁容器
	 */
	public static async destroy(): Promise<void> {
		const instances = Array.from(Container.instances.entries());

		for (const [componentName, instance] of instances) {
			// 获取组件构造函数
			// biome-ignore lint/style/noNonNullAssertion: 一定存在
			const componentConstructor = Container.registry.get(componentName)!;
			const componentExtensions = Reflect.getMetadata(metadata.COMPONENT_EXTENSIONS, componentConstructor) ?? [];

			// 执行 preDestroy 扩展钩子
			for (const extension of componentExtensions) {
				if (extension.preDestroy) await extension.preDestroy(instance);
			}
			for (const extension of Container.extensions) {
				if (extension.preDestroy) await extension.preDestroy(instance);
			}

			Container.registry.delete(componentName);
			Container.instances.delete(componentName);

			// 执行 postDestroy 扩展钩子
			for (const extension of componentExtensions) {
				if (extension.postDestroy) await extension.postDestroy();
			}
			for (const extension of Container.extensions) {
				if (extension.postDestroy) await extension.postDestroy();
			}
		}

		// 清空容器
		Container.instances.clear();
		Container.registry.clear();
		Container.factoryComponents.clear();
	}

	/**
	 * 自动处理依赖并创建实例
	 * @param component 组件
	 */
	private static async createInstance<T>(component: Constructor<T>): Promise<T> {
		// 获取通过 `@Inject` 注解指定的依赖组件
		const injectComponents = Reflect.getMetadata(metadata.INJECT_COMPONENT, component) ?? [];
		const componentName = Reflect.getMetadata(metadata.COMPONENT_NAME, component);

		// 获取构造函数参数类型
		const tokens = Reflect.getMetadata("design:paramtypes", component) ?? [];

		// 解析所有依赖实例
		const dependencyInstances = await Promise.all(
			tokens.map((token: Constructor<unknown>, index: number) =>
				Container.resolveDependency(token, injectComponents[index], componentName),
			),
		);

		const instance = new component(...dependencyInstances);

		// 处理属性注入
		await Container.injectProperties(instance, component);

		return instance;
	}

	/**
	 * 处理属性注入
	 * @param instance 组件实例
	 * @param component 组件构造函数
	 */
	private static async injectProperties<T>(instance: T, component: Constructor<T>): Promise<void> {
		// 获取通过 `@Inject` 注解指定的依赖组件
		const injectProperties = Reflect.getMetadata(metadata.INJECT_PROPERTY, component) ?? [];
		const componentName = Reflect.getMetadata(metadata.COMPONENT_NAME, component);

		// 解析所有属性依赖实例
		for (const { propertyKey, options } of injectProperties) {
			const dependencyInstance = await Container.resolvePropertyDependency(options, componentName);
			(instance as Record<PropertyKey, unknown>)[propertyKey] = dependencyInstance;
		}
	}

	/**
	 * 解析单个属性依赖项
	 * @param injectOptions 注入选项
	 * @param targetName 目标组件名称 (用于错误信息)
	 */
	private static async resolvePropertyDependency<T>(
		injectOptions: InjectOptions<T> | undefined,
		targetName?: string,
	): Promise<T> {
		if (!injectOptions) {
			throw new DependencyNotFoundException("未知属性依赖", targetName);
		}

		// 如果指定了 component, 则直接使用
		if ("component" in injectOptions && injectOptions.component) {
			await Container.register(injectOptions.component);
			return Container.resolve(injectOptions.component);
		}

		// 如果指定了 name, 则根据名称查找组件
		if ("name" in injectOptions && injectOptions.name) {
			// 根据名称查找组件构造函数
			for (const [componentName, componentConstructor] of Container.registry.entries()) {
				if (componentName === injectOptions.name) {
					return Container.resolve(componentConstructor as Constructor<T>);
				}
			}

			// 如果找不到指定名称的组件, 抛出异常
			throw new DependencyNotFoundException(injectOptions.name, targetName);
		}

		// 如果没有指定选项, 抛出异常
		throw new DependencyNotFoundException("未知属性依赖", targetName);
	}

	/**
	 * 解析单个依赖项
	 * @param dep 依赖项类型
	 * @param injectOptions 注入选项
	 * @param targetName 目标组件名称 (用于错误信息)
	 */
	private static async resolveDependency<T>(
		dep: Constructor<T> | undefined,
		injectOptions: InjectOptions<T> | undefined,
		targetName?: string,
	): Promise<T> {
		if (injectOptions) {
			// 如果指定了 component, 则直接使用
			if ("component" in injectOptions && injectOptions.component) {
				await Container.register(injectOptions.component);
				return Container.resolve(injectOptions.component);
			}

			// 如果指定了 name, 则根据名称查找组件
			if ("name" in injectOptions && injectOptions.name) {
				// 根据名称查找组件构造函数
				for (const [componentName, componentConstructor] of Container.registry.entries()) {
					if (componentName === injectOptions.name) {
						return Container.resolve(componentConstructor) as T;
					}
				}

				// 如果找不到指定名称的组件, 抛出异常
				throw new DependencyNotFoundException(injectOptions.name, targetName);
			}
		}

		// 默认行为: 使用类型反射解析
		if (dep) {
			await Container.register(dep);
			return Container.resolve(dep);
		}

		// 如果依赖无法解析, 则抛出异常
		throw new DependencyNotFoundException("未知依赖", targetName);
	}

	/**
	 * 检查是否已经注册此组件
	 * @param component 组件
	 */
	public static has<T>(component: Constructor<T>): boolean {
		const componentName = Reflect.getMetadata(metadata.COMPONENT_NAME, component);
		if (!componentName) return false;
		return Container.registry.has(componentName);
	}

	/**
	 * 获取已注册的组件数量
	 */
	public static get registerSize() {
		return Container.registry.size;
	}

	/**
	 * 添加容器扩展
	 * @param extension 扩展
	 */
	public static addExtension(extension: ContainerExtensionInterface) {
		Container.extensions.push(extension);
	}
}
