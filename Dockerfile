FROM php:8.2-apache

# Instala as extensões do PHP necessárias para o MySQL
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Ativa o mod_rewrite do Apache (para rotas limpas, se necessário)
RUN a2enmod rewrite

# Copia os ficheiros do projeto para o diretório web do Apache
COPY . /var/www/html/

# Configura permissões
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80