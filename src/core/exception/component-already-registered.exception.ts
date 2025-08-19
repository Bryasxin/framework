import { Exception } from "./exception";

/** 组件已经被注册 */
export class ComponentAlreadyRegisteredException extends Exception {
	constructor(public readonly componentName: string) {
		super(`组件 ${componentName} 已被注册, 请勿多次使用装饰器`);
	}
}
