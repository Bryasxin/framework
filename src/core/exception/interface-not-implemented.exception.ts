import { Exception } from "./exception";

/** 接口未实现 */
export class InterfaceNotImplementedException extends Exception {
	constructor(public readonly interfaceName: string) {
		super(`未实现 "${interfaceName}" 接口`);
	}
}
