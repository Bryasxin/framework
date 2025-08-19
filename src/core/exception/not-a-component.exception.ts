import { Exception } from "./exception";

/** 不是一个组件 */
export class NotAComponentException extends Exception {
	constructor(public readonly className: string) {
		super(`类 ${className} 不是一个组件`);
	}
}
