export interface GreetOptions {
  name: string;
  excited?: boolean;
}

export function greet({ name, excited = false }: GreetOptions): string {
  return `Hello, ${name}${excited ? '!' : '.'}`;
}
