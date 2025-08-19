import type { Constructor } from "type-fest";
import { Container } from "./core";
import type { ComponentOptions, ContainerExtensionInterface, InjectOptions } from "./interface";
import * as metadata from "./metadata";
import { throwIfIsComponent } from "./utilities";

/**
 * 装饰器: 标记为组件
 * @param options 组件选项
 */
export const Component = (options?: ComponentOptions): ClassDecorator => {
	return (target) => {
		throwIfIsComponent(target);

		// 设置组件元数据
		const componentName = options?.name ?? target.name;
		const componentScope = options?.scope ?? "singleton";
		Reflect.defineMetadata(metadata.COMPONENT_NAME, componentName, target);
		Reflect.defineMetadata(metadata.COMPONENT_SCOPE, componentScope, target);

		// 自动注册组件到容器
		Container.register(target as unknown as Constructor<unknown>);
	};
};

/**
 * 装饰器: 标记为组件工厂
 * @param options 工厂选项
 */
export const ComponentFactory = (options?: ComponentOptions): ClassDecorator => {
	return (target) => {
		throwIfIsComponent(target);

		// 设置组件元数据
		const componentName = options?.name ?? target.name;
		const componentScope = options?.scope ?? "singleton";
		Reflect.defineMetadata(metadata.COMPONENT_NAME, componentName, target);
		Reflect.defineMetadata(metadata.COMPONENT_SCOPE, componentScope, target);

		// 设置工厂元数据
		Reflect.defineMetadata(metadata.IS_COMPONENT_FACTORY, true, target);

		// 自动注册工厂组件到容器
		Container.register(target as unknown as Constructor<unknown>);
	};
};

/**
 * 装饰器: 标记工厂方法返回的组件类型
 * @param component 要返回的组件构造函数
 * @param options 组件选项
 */
export const ReturnComponent = <T>(component: Constructor<T>, options?: ComponentOptions): MethodDecorator => {
	return (target, propertyKey) => {
		throwIfIsComponent(component);

		// 设置组件元数据
		const componentName = options?.name ?? component.name;
		const componentScope = options?.scope ?? "singleton";
		Reflect.defineMetadata(metadata.COMPONENT_NAME, componentName, component);
		Reflect.defineMetadata(metadata.COMPONENT_SCOPE, componentScope, component);

		// 存储工厂方法信息
		Reflect.defineMetadata(metadata.FACTORY_RESULT, { component, options }, target, propertyKey);
	};
};

/**
 * 装饰器: 标记为容器扩展
 */
export const ContainerExtension: ClassDecorator = (target) => {
	throwIfIsComponent(target);

	// 为容器扩展设置元数据
	Reflect.defineMetadata(metadata.COMPONENT_NAME, target.name, target);
	Reflect.defineMetadata(metadata.COMPONENT_SCOPE, "singleton", target);

	const _target = target as unknown as Constructor<ContainerExtensionInterface>;

	Container.register(_target)
		.then(() => Container.resolve(_target))
		.then(Container.addExtension);
};

/**
 * 装饰器: 注入构造函数参数或属性
 * @param options 注入选项
 */
export const Inject = <T>(options?: InjectOptions<T>): ParameterDecorator & PropertyDecorator => {
	return (target, propertyKey, parameterIndex?): void => {
		// 如果提供了 parameterIndex, 则说明是用在构造函数参数上
		if (typeof parameterIndex === "number") {
			// 获取已存在的参数注入元数据或创建新的
			const injectComponents = Reflect.getMetadata(metadata.INJECT_COMPONENT, target) ?? [];
			// 记录在指定参数索引处要注入的组件信息
			injectComponents[parameterIndex] = options;

			Reflect.defineMetadata(metadata.INJECT_COMPONENT, injectComponents, target);
		}
		// 否则是用在属性上
		else if (typeof propertyKey !== "undefined") {
			// 获取已存在的属性注入元数据或创建新的
			const injectProperties = Reflect.getMetadata(metadata.INJECT_PROPERTY, target.constructor) ?? [];
			// 记录要注入的组件信息
			injectProperties.push({ propertyKey, options });

			Reflect.defineMetadata(metadata.INJECT_PROPERTY, injectProperties, target.constructor);
		}
	};
};

/**
 * 装饰器: 为组件添加扩展
 * @param extension 扩展或扩展构造函数
 */
export const AddExtension = (extension: Constructor<ContainerExtensionInterface>): MethodDecorator => {
	return (target) => {
		const extensions = Reflect.getMetadata(metadata.COMPONENT_EXTENSIONS, target) ?? [];
		extensions.push(extension);
		Reflect.defineMetadata(metadata.COMPONENT_EXTENSIONS, extensions, target);
	};
};
