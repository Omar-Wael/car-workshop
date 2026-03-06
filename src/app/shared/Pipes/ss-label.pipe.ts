import { Pipe, PipeTransform } from "@angular/core";
import { SelectOption } from "src/app/core/models";

@Pipe({ name: "ssLabel", standalone: true, pure: false })
export class SsLabelPipe implements PipeTransform {
  transform(options: SelectOption[], value: string): string {
    return options.find((o) => o.value === value)?.label ?? value;
  }
}
