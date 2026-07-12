update anbieter
set user_id = (select id from auth.users where email = 'luca.fersch96+test@gmail.com')
where id = 6;