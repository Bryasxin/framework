/** 异常基类 */
export class Exception extends Error {
	constructor(public override readonly message: string) {
		super(message);
	}

	public readonly timestamp: number = Date.now();
}
