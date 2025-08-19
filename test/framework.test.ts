/** biome-ignore-all lint/correctness/noUnusedVariables: explanation */
import "reflect-metadata";
import { beforeEach, describe, expect, test } from "bun:test";
import { Component, ComponentFactory, Container, ContainerExtension, Inject, ReturnComponent } from "../src";

// 清理容器状态
beforeEach(() => {
	const registry = Reflect.get(Container, "registry");
	const instances = Reflect.get(Container, "instances");
	const extensions = Reflect.get(Container, "extensions");
	const factoryComponents = Reflect.get(Container, "factoryComponents");
	const eventPublishers = Reflect.get(Container, "eventPublishers");
	const eventHandlers = Reflect.get(Container, "eventHandlers");

	registry.clear();
	instances.clear();
	extensions.length = 0;
	if (factoryComponents) factoryComponents.clear();
	if (eventPublishers) eventPublishers.clear();
	if (eventHandlers) eventHandlers.clear();
});

describe("Framework Core 重构测试", () => {
	test("应该正确处理组件装饰器和基本容器功能", async () => {
		// 测试默认组件
		@Component()
		class DefaultComponent {
			getValue() {
				return "default";
			}
		}

		// 测试自定义组件
		@Component({ scope: "prototype" })
		class CustomComponent {
			public id = Math.random();
			getValue() {
				return "custom";
			}
		}

		// 验证容器注册和解析
		const defaultInstance1 = await Container.resolve(DefaultComponent);
		const defaultInstance2 = await Container.resolve(DefaultComponent);
		expect(defaultInstance1.getValue()).toBe("default");
		// 验证单例模式
		expect(defaultInstance1).toBe(defaultInstance2);

		const customInstance1 = await Container.resolve(CustomComponent);
		const customInstance2 = await Container.resolve(CustomComponent);
		expect(customInstance1.getValue()).toBe("custom");
		// 验证原型模式
		expect(customInstance1).not.toBe(customInstance2);
		expect(customInstance1.id).not.toBe(customInstance2.id);
	});

	test("应该正确处理组件扩展功能", async () => {
		let preCreateCalled = false;
		let postCreateCalled = false;

		@ContainerExtension
		class TestExtension {
			async preCreate() {
				preCreateCalled = true;
			}

			async postCreate() {
				postCreateCalled = true;
			}
		}

		@Component()
		class ExtendedComponent {
			getValue() {
				return "extended";
			}
		}

		expect(preCreateCalled).toBe(false);
		expect(postCreateCalled).toBe(false);

		const instance = await Container.resolve(ExtendedComponent);
		expect(instance.getValue()).toBe("extended");
	});

	test("应该正确处理工厂模式", async () => {
		abstract class DatabaseService {
			abstract connect(): string;
		}

		class MySQLService extends DatabaseService {
			connect() {
				return "Connected to MySQL";
			}
		}

		@ComponentFactory()
		class DatabaseFactory {
			@ReturnComponent(MySQLService)
			createMySQLService(): DatabaseService {
				return new MySQLService();
			}
		}

		const factory = await Container.resolve(DatabaseFactory);
		expect(factory).toBeInstanceOf(DatabaseFactory);

		const service = await Container.resolve(MySQLService);
		expect(service.connect()).toBe("Connected to MySQL");
	});

	test("应该正确处理依赖注入", async () => {
		@Component()
		class ServiceA {
			getValue() {
				return "A";
			}
		}

		@Component()
		class ServiceB {
			getValue() {
				return "B";
			}
		}

		@Component()
		class ServiceC {
			constructor(
				private serviceA: ServiceA,
				@Inject({ name: "ServiceB" }) private service: ServiceB,
			) {}

			getValue() {
				return this.serviceA.getValue() + this.service.getValue();
			}
		}

		@Component()
		class ServiceD {
			@Inject({ component: ServiceA })
			private serviceA!: ServiceA;

			getValue() {
				return `${this.serviceA.getValue()}D`;
			}
		}

		const serviceC = await Container.resolve(ServiceC);
		expect(serviceC.getValue()).toBe("AB");

		const serviceD = await Container.resolve(ServiceD);
		expect(serviceD.getValue()).toBe("AD");
	});

	test("应该正确处理容器扩展的preDestroy和postDestroy钩子", async () => {
		let preDestroyCalled = false;
		let postDestroyCalled = false;

		@ContainerExtension
		class DestructionExtension {
			async preDestroy() {
				preDestroyCalled = true;
			}

			async postDestroy() {
				postDestroyCalled = true;
			}
		}

		@Component()
		class DestructibleComponent {
			value = "test";
		}

		// 创建实例确保组件被注册
		const instance = await Container.resolve(DestructibleComponent);
		expect(instance).toBeInstanceOf(DestructibleComponent);

		// 等待扩展被添加
		await new Promise((resolve) => setTimeout(resolve, 10));

		// 销毁容器
		await Container.destroy();

		expect(preDestroyCalled).toBe(true);
		expect(postDestroyCalled).toBe(true);
	});

	test("应该正确处理组件的has方法", async () => {
		@Component()
		class TestHasComponent {
			value = "test";
		}

		expect(Container.has(TestHasComponent)).toBe(true);

		// 创建一个未注册的组件
		class UnregisteredComponent {
			value = "unregistered";
		}

		expect(Container.has(UnregisteredComponent)).toBe(false);
	});

	test("应该正确处理registerSize属性", async () => {
		const initialSize = Container.registerSize;

		@Component()
		class SizeTestComponent1 {
			value = "test1";
		}

		@Component()
		class SizeTestComponent2 {
			value = "test2";
		}

		expect(Container.registerSize).toBe(initialSize + 2);
	});

	test("应该正确处理非组件解析时抛出异常", async () => {
		class NotAComponent {
			value = "not a component";
		}

		await expect(async () => {
			await Container.resolve(NotAComponent);
		}).toThrow(/不是一个组件/);
	});

	test("应该正确处理依赖注入中的名称查找", async () => {
		@Component({ name: "NamedService" })
		class NamedService {
			getValue() {
				return "named";
			}
		}

		@Component()
		class Consumer {
			constructor(@Inject({ name: "NamedService" }) private service: NamedService) {}

			getValue() {
				return this.service.getValue();
			}
		}

		const consumer = await Container.resolve(Consumer);
		expect(consumer.getValue()).toBe("named");
	});

	test("应该正确处理属性注入中的组件类型", async () => {
		@Component()
		class PropertyInjectedService {
			getValue() {
				return "property injected";
			}
		}

		@Component()
		class PropertyConsumer {
			@Inject({ component: PropertyInjectedService })
			service!: PropertyInjectedService;

			getValue() {
				return this.service.getValue();
			}
		}

		const consumer = await Container.resolve(PropertyConsumer);
		expect(consumer.getValue()).toBe("property injected");
	});
});
