import { Exception } from "./exception";

/** 到达标记为无法到达的代码 */
export class UnreachableCodeException extends Exception {
	constructor() {
		super(`进入不可达代码`);
	}
}
