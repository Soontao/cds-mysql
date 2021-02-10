import { v4 } from "uuid";

export const createRandomName = () => v4().split("-").pop();
