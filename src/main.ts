import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { provideAnimations } from "@angular/platform-browser/animations";
import { registerLocaleData } from "@angular/common";
import localeAr from "@angular/common/locales/ar";
import { LOCALE_ID } from "@angular/core";

// Register Arabic locale data
registerLocaleData(localeAr);

bootstrapApplication(AppComponent, {
  providers: [provideAnimations(), { provide: LOCALE_ID, useValue: "ar" }],
}).catch((err) => console.error(err));
