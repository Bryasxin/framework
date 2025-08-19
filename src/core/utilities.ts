import { ComponentAlreadyRegisteredException, NotAComponentException } from "./exception";
import * as metadata from "./metadata";

/** 如果传入的 target 被显式地标记为组件, 则抛出错误 */
export const throwIfIsComponent = (target: object) => {
	if (Reflect.hasOwnMetadata(metadata.COMPONENT_NAME, target)) {
		const maybeComponentName = Reflect.getMetadata(metadata.COMPONENT_NAME, target);
		throw new ComponentAlreadyRegisteredException(maybeComponentName);
	}
};

/** 如果传入的 target 被没有被显式地标记为组件, 则抛出错误 */
export const throwIfIsNotComponent = (target: object) => {
	if (!Reflect.hasOwnMetadata(metadata.COMPONENT_NAME, target)) {
		throw new NotAComponentException("name" in target && typeof target.name === "string" ? target.name : "Unknown");
	}
};
