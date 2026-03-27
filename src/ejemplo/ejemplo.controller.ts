import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { EjemploService } from './ejemplo.service';
import { EjemploEntity } from './ejemplo.entity';

@Controller('ejemplo')
export class EjemploController {
  constructor(private service: EjemploService) {}

  // GET /ejemplo
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // GET /ejemplo/buscar?nombre=abc
  @Get('buscar')
  buscar(@Query('nombre') nombre: string) {
    return this.service.buscarPorNombre(nombre);
  }

  // GET /ejemplo/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  // POST /ejemplo
  @Post()
  create(@Body() body: Partial<EjemploEntity>) {
    return this.service.create(body);
  }

  // PUT /ejemplo/:id
  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<EjemploEntity>) {
    return this.service.update(+id, body);
  }

  // DELETE /ejemplo/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }
}
