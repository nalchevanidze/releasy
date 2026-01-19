export class Version {
  private constructor(public value: string) {}

  static parse(input: string) {
    return new Version(input.replace(/^v/, ""));
  }

  public toString() {
    return `v${this.value}`;
  }

  public isEqual(v: string) {
    if (this.value !== v.replace(/^v/, "")) {
      throw Error(`versions does not match: ${this.value} ${v}`);
    }
  }
}
