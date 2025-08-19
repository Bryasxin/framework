import { Exception } from "./exception";

/** 无法处理依赖 */
export class DependencyNotFoundException extends Exception {
	constructor(
		public readonly dependency: string,
		public readonly componentName?: string,
	) {
		if (componentName) {
			super(`组件 "${componentName}" 依赖 "${dependency}" 未找到 `);
		} else {
			super(`依赖 "${dependency}" 未找到`);
		}
	}
}
