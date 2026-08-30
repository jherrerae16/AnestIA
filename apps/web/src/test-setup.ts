// El compilador de Angular en tiempo de ejecución (JIT). Sin este import, un `@Component` con
// plantilla en línea no se compila y `createComponent` falla.
import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
